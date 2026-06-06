import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildVerificationOrchestrationRuntime } from "./verification-orchestration-runtime.mjs";

export const DEFAULT_MULTI_ENGINE_ORCHESTRATION_QA_OUT_DIR = "artifacts/multi-engine-orchestration-qa/latest";
export const DEFAULT_MULTI_ENGINE_ORCHESTRATION_QA_INPUTS = {
  schemaPath: "schemas/multi-engine-orchestration-qa.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:multi-engine-orchestration-qa";
const VERIFICATION_COMMAND_NAME = "platform:verification-orchestration-runtime";
const SCHEMA_VERSION = "multi-engine-orchestration-qa.v1";
const CAPABILITY_ID = "platform.multi_engine_orchestration_qa";
const PROGRAM_RANGE = "P5401-P5800";
const READY_STATUS = "ready_for_multi_engine_orchestration_qa_v0";
const VERIFICATION_READY_STATUS = "ready_for_verification_orchestration_runtime_v0";

const PHASE_SPECS = [
  ["P5401-P5440", "Primary Engine Selection Registry"],
  ["P5441-P5480", "Reviewer Engine Lane"],
  ["P5481-P5520", "Planner and Evidence Role Split"],
  ["P5521-P5560", "Cross-Model QA Packet Contract"],
  ["P5561-P5600", "Model Upgrade Receipt Contract"],
  ["P5601-P5640", "Engine Conflict Resolution"],
  ["P5641-P5680", "Reviewer No-Mutation Boundary"],
  ["P5681-P5720", "Cross-Review Finding Loop"],
  ["P5721-P5760", "Multi-Engine Trust Decision Rows"],
  ["P5761-P5800", "Multi-Engine QA Freeze"],
];

const ENGINE_SPECS = [
  ["engine.codex.primary_developer", "Codex", "PRIMARY_DEVELOPER", "plan, implement, test, prepare review packets", true, false],
  ["engine.harness.deterministic_validator", "Harness", "DETERMINISTIC_VALIDATOR", "run validators, gates, normalization, trust classification", false, false],
  ["engine.claude_code_opus_max.independent_reviewer", "Claude Code Opus max", "INDEPENDENT_REVIEWER", "review Codex-created packets and produce findings without mutation", false, true],
  ["engine.github_attestation.external_observer", "GitHub and attestation", "EXTERNAL_EVIDENCE_OBSERVER", "observe CI, required checks, attestations, branch and ruleset evidence", false, false],
  ["engine.future_reviewer_model.candidate", "Future reviewer model", "MODEL_UPGRADE_CANDIDATE", "replace Claude reviewer only after model upgrade receipt", false, false],
];

const ROLE_SPECS = [
  ["role.planner", "Planner", "engine.codex.primary_developer"],
  ["role.implementer", "Implementer", "engine.codex.primary_developer"],
  ["role.validator", "Validator", "engine.harness.deterministic_validator"],
  ["role.independent_reviewer", "Independent Reviewer", "engine.claude_code_opus_max.independent_reviewer"],
  ["role.evidence_summarizer", "Evidence Summarizer", "engine.harness.deterministic_validator"],
  ["role.conflict_resolver", "Conflict Resolver", "engine.harness.deterministic_validator"],
];

const CONFLICT_SPECS = [
  ["conflict.codex_vs_claude_finding", "Codex implementation claim conflicts with Claude review finding", "BLOCK_UNTIL_FINDING_LOOP"],
  ["conflict.validator_vs_review", "Harness validator result conflicts with reviewer conclusion", "BLOCK_UNTIL_DUAL_RUN_REVIEW"],
  ["conflict.source_context_drift", "Reviewer packet source context is stale or uncited", "BLOCK_UNTIL_CONTEXT_REBUILD"],
  ["conflict.model_upgrade_unclear", "Reviewer model alias changes without receipt", "BLOCK_MODEL_UPGRADE"],
  ["conflict.self_approval_attempt", "Same engine attempts to implement and approve", "BLOCK_SELF_APPROVAL"],
];

export async function runMultiEngineOrchestrationQa(options = {}) {
  const result = await buildMultiEngineOrchestrationQa(options);
  if (options.write !== false) await writeMultiEngineOrchestrationQa(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Multi-engine orchestration QA failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMultiEngineOrchestrationQa(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_QA_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const verificationRuntime = options.verificationRuntime ?? await buildVerificationOrchestrationRuntime({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildQaContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const engineRegistryRows = buildEngineRegistryRows(generatedAt);
  const roleAssignmentRows = buildRoleAssignmentRows(generatedAt);
  const crossModelQaPacketRows = buildCrossModelQaPacketRows(verificationRuntime, generatedAt);
  const modelUpgradeReceiptRows = buildModelUpgradeReceiptRows(generatedAt);
  const conflictResolutionRows = buildConflictResolutionRows(generatedAt);
  const reviewerBoundaryRows = buildReviewerBoundaryRows(generatedAt);
  const findingLoopRows = buildFindingLoopRows(crossModelQaPacketRows, generatedAt);
  const trustDecisionRows = buildTrustDecisionRows({ verificationRuntime, crossModelQaPacketRows, modelUpgradeReceiptRows, findingLoopRows, generatedAt });
  const freezeRows = buildFreezeRows({ engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, verificationRuntime, contract, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows });
  const boundary = buildBoundary({ verificationRuntime, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, verificationRuntime, contract, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    multi_engine_orchestration_qa_id: `multi-engine-orchestration-qa.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_verification_orchestration_runtime_summary: verificationRuntime.summary,
    multi_engine_orchestration_contract: contract,
    multi_engine_phase_rows: phaseRows,
    engine_registry_rows: engineRegistryRows,
    role_assignment_rows: roleAssignmentRows,
    cross_model_qa_packet_rows: crossModelQaPacketRows,
    model_upgrade_receipt_rows: modelUpgradeReceiptRows,
    engine_conflict_resolution_rows: conflictResolutionRows,
    reviewer_boundary_rows: reviewerBoundaryRows,
    cross_review_finding_loop_rows: findingLoopRows,
    multi_engine_trust_decision_rows: trustDecisionRows,
    multi_engine_qa_freeze_rows: freezeRows,
    multi_engine_qa_gate_rows: gateRows,
    multi_engine_qa_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ verificationRuntime, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "multi_engine_orchestration_qa")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ verificationRuntime, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.multi_engine_orchestration_qa_id = result.multi_engine_orchestration_qa_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeMultiEngineOrchestrationQa(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "multi-engine-orchestration-qa.json"), serializableResult(result));
  await writeJson(path.join(outDir, "engine-registry-rows.json"), collectionEnvelope("engine-registry-rows.v1", "engine_registry_rows", result.engine_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "role-assignment-rows.json"), collectionEnvelope("role-assignment-rows.v1", "role_assignment_rows", result.role_assignment_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-model-qa-packet-rows.json"), collectionEnvelope("cross-model-qa-packet-rows.v1", "cross_model_qa_packet_rows", result.cross_model_qa_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-upgrade-receipt-rows.json"), collectionEnvelope("model-upgrade-receipt-rows.v1", "model_upgrade_receipt_rows", result.model_upgrade_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "engine-conflict-resolution-rows.json"), collectionEnvelope("engine-conflict-resolution-rows.v1", "engine_conflict_resolution_rows", result.engine_conflict_resolution_rows, result.generated_at));
  await writeJson(path.join(outDir, "reviewer-boundary-rows.json"), collectionEnvelope("reviewer-boundary-rows.v1", "reviewer_boundary_rows", result.reviewer_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-review-finding-loop-rows.json"), collectionEnvelope("cross-review-finding-loop-rows.v1", "cross_review_finding_loop_rows", result.cross_review_finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-trust-decision-rows.json"), collectionEnvelope("multi-engine-trust-decision-rows.v1", "multi_engine_trust_decision_rows", result.multi_engine_trust_decision_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-qa-freeze-rows.json"), collectionEnvelope("multi-engine-qa-freeze-rows.v1", "multi_engine_qa_freeze_rows", result.multi_engine_qa_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-qa-gate-rows.json"), collectionEnvelope("multi-engine-qa-gate-rows.v1", "multi_engine_qa_gate_rows", result.multi_engine_qa_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-qa-boundary.json"), result.multi_engine_qa_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "multi-engine-orchestration-qa-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMultiEngineOrchestrationQaCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runMultiEngineOrchestrationQa(args);
    console.log(`Multi-engine orchestration QA ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.multi_engine_orchestration_qa_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Engines: ${result.summary.engine_count}`);
    console.log(`Role assignments: ${result.summary.role_assignment_count}`);
    console.log(`Cross-model QA packets: ${result.summary.cross_model_qa_packet_count}`);
    console.log(`P5800 closeout ready: ${result.summary.p5800_milestone_closeout_ready}`);
    console.log(`Self approval allowed: ${result.summary.self_approval_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildQaContract(generatedAt) {
  return {
    schema_version: "multi-engine-orchestration-contract.v1",
    generated_at: generatedAt,
    contract_id: "multi-engine-orchestration-qa-contract.p5401-p5800",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5001-P5400",
    primary_engine_required: true,
    reviewer_engine_required: true,
    planner_evidence_role_split_required: true,
    cross_model_qa_packet_required: true,
    model_upgrade_receipt_required: true,
    engine_conflict_resolution_required: true,
    reviewer_no_mutation_boundary_required: true,
    finding_loop_required: true,
    one_engine_self_approval_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_source_mutation_allowed: false,
    model_upgrade_applied_now: false,
    p5800_closeout_requires_completed_review_receipt: true,
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
      schema_version: "multi-engine-phase-row.v1",
      row_id: `multi.engine.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.multi_engine_qa.${phase_range}`,
      responsible_owner: "platform_multi_engine_owner",
      next_allowed_action: pass ? "preserve multi-engine phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildEngineRegistryRows(generatedAt) {
  return ENGINE_SPECS.map(([engine_id, engine_name, engine_role, authority_scope, can_mutate_source, can_review_independently], index) => ({
    schema_version: "engine-registry-row.v1",
    row_id: `engine.registry.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    engine_id,
    engine_name,
    engine_role,
    authority_scope,
    engine_status: engine_role === "MODEL_UPGRADE_CANDIDATE" ? "CANDIDATE_PENDING_RECEIPT" : "REGISTERED",
    can_mutate_source,
    can_review_independently,
    can_review_own_work: false,
    can_finally_approve: false,
    can_claim_enterprise_trust: false,
    model_upgrade_receipt_required: engine_role === "MODEL_UPGRADE_CANDIDATE",
    reviewer_ref: engine_role === "INDEPENDENT_REVIEWER" ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    evidence_ref: `evidence.multi_engine.engine.${engine_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: engine_role === "MODEL_UPGRADE_CANDIDATE" ? "collect model upgrade receipt before use" : "preserve engine role registration",
  }));
}

function buildRoleAssignmentRows(generatedAt) {
  return ROLE_SPECS.map(([role_id, role_name, engine_ref], index) => ({
    schema_version: "role-assignment-row.v1",
    row_id: `role.assignment.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    role_id,
    role_name,
    engine_ref,
    role_status: "ASSIGNED",
    source_mutation_allowed: role_id === "role.implementer" || role_id === "role.planner",
    review_authority_allowed: role_id === "role.independent_reviewer",
    final_approval_allowed: false,
    self_approval_allowed: false,
    human_adjudication_required: false,
    evidence_ref: `evidence.multi_engine.role.${role_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: "show role separation in console",
  }));
}

function buildCrossModelQaPacketRows(verificationRuntime, generatedAt) {
  return [
    {
      schema_version: "cross-model-qa-packet-row.v1",
      row_id: "cross.model.qa.packet.row.001",
      generated_at: generatedAt,
      qa_packet_id: "cross-model-qa.p5800.codex-to-claude",
      source_program_range: "P5001-P5400",
      verification_runtime_status: verificationRuntime.summary?.verification_orchestration_runtime_status ?? "unknown",
      primary_engine_ref: "engine.codex.primary_developer",
      reviewer_engine_ref: "engine.claude_code_opus_max.independent_reviewer",
      validator_ref: "engine.harness.deterministic_validator",
      required_evidence_refs: [
        "artifacts/verification-orchestration-runtime/latest/verification-orchestration-runtime.json",
        "artifacts/verification-orchestration-runtime/latest/normalized-verification-result-rows.json",
        "artifacts/verification-orchestration-runtime/latest/claude-review-receipt-rows.json"
      ],
      qa_packet_status: "READY_FOR_CLAUDE_REVIEW",
      qa_packet_completed_now: false,
      claude_review_receipt_required: true,
      durable_raw_json_required: true,
      self_approval_allowed: false,
      reviewer_mutation_allowed: false,
      human_adjudication_required: false,
      protected_closeout_enabled: false,
      evidence_ref: "evidence.multi_engine.qa_packet.p5800",
      unsafe_flags_false: verificationRuntime.summary?.verification_orchestration_runtime_status === VERIFICATION_READY_STATUS,
      verdict_authority: "harness_only",
      next_allowed_action: "capture Claude Code Opus max review receipt for P5800 before closeout",
    },
  ];
}

function buildModelUpgradeReceiptRows(generatedAt) {
  return [
    {
      schema_version: "model-upgrade-receipt-row.v1",
      row_id: "model.upgrade.receipt.row.001",
      generated_at: generatedAt,
      model_upgrade_receipt_id: "model-upgrade.claude-reviewer.current",
      current_reviewer_model_alias: "claude-code-opus-max",
      current_resolved_model_id: null,
      latest_model_monitor_required: true,
      upgrade_candidate_model_alias: null,
      upgrade_applied_now: false,
      upgrade_allowed_without_receipt: false,
      compatibility_review_required: true,
      rollback_model_alias: "claude-code-opus-max",
      receipt_status: "CURRENT_MODEL_LOCKED_PENDING_UPGRADE_RECEIPT",
      evidence_ref: "evidence.multi_engine.model_upgrade.current",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: "keep Claude Code Opus max until newer reviewer model has receipt",
    },
  ];
}

function buildConflictResolutionRows(generatedAt) {
  return CONFLICT_SPECS.map(([conflict_id, scenario, resolution_policy], index) => ({
    schema_version: "engine-conflict-resolution-row.v1",
    row_id: `engine.conflict.resolution.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    conflict_id,
    scenario,
    resolution_policy,
    conflict_status: "POLICY_READY",
    auto_pass_allowed: false,
    self_approval_allowed: false,
    requires_harness_normalization: true,
    reviewer_ref: "reviewer.harness_contract",
    evidence_ref: `evidence.multi_engine.conflict.${conflict_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: "block milestone movement until conflict policy resolves",
  }));
}

function buildReviewerBoundaryRows(generatedAt) {
  const specs = [
    ["boundary.reviewer_no_mutation", "Reviewer cannot mutate source", false],
    ["boundary.reviewer_no_final_approval", "Reviewer cannot finally approve protected closeout", false],
    ["boundary.codex_no_self_approval", "Codex cannot approve Codex-created work", false],
    ["boundary.no_enterprise_trust", "Claude-reviewed single-owner mode cannot claim enterprise trust", false],
    ["boundary.no_human_gate_assumption", "No-human milestone gate cannot imply protected final decision", false],
  ];
  return specs.map(([boundary_id, description, allowed], index) => ({
    schema_version: "reviewer-boundary-row.v1",
    row_id: `reviewer.boundary.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    boundary_id,
    description,
    allowed,
    boundary_status: "ENFORCED_BY_CONTRACT",
    reviewer_ref: "reviewer.claude_code_opus_max",
    evidence_ref: `evidence.multi_engine.reviewer_boundary.${boundary_id}`,
    unsafe_flags_false: allowed === false,
    verdict_authority: "harness_only",
    next_allowed_action: "preserve reviewer boundary",
  }));
}

function buildFindingLoopRows(crossModelQaPacketRows, generatedAt) {
  return crossModelQaPacketRows.map((packet, index) => ({
    schema_version: "cross-review-finding-loop-row.v1",
    row_id: `cross.review.finding.loop.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    finding_loop_id: `finding-loop.${packet.qa_packet_id}`,
    qa_packet_id: packet.qa_packet_id,
    finding_loop_status: "WAITING_FOR_CLAUDE_REVIEW_RECEIPT",
    findings_present_now: false,
    findings_normalized_now: false,
    revalidation_required_after_findings: true,
    revalidation_completed_now: false,
    loop_can_close_now: false,
    self_approval_allowed: false,
    evidence_ref: `evidence.multi_engine.finding_loop.${packet.qa_packet_id}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    next_allowed_action: "wait for completed Claude review receipt and rerun validators after findings",
  }));
}

function buildTrustDecisionRows({ verificationRuntime, crossModelQaPacketRows, modelUpgradeReceiptRows, findingLoopRows, generatedAt }) {
  const localContractsReady = verificationRuntime.summary?.verification_orchestration_runtime_status === VERIFICATION_READY_STATUS
    && crossModelQaPacketRows.every((row) => row.qa_packet_status === "READY_FOR_CLAUDE_REVIEW")
    && modelUpgradeReceiptRows.every((row) => row.upgrade_allowed_without_receipt === false)
    && findingLoopRows.every((row) => row.revalidation_required_after_findings);
  const completedReviewReady = crossModelQaPacketRows.every((row) => row.qa_packet_completed_now)
    && findingLoopRows.every((row) => row.loop_can_close_now);
  return [
    {
      schema_version: "multi-engine-trust-decision-row.v1",
      row_id: "multi.engine.trust.decision.row.001",
      generated_at: generatedAt,
      milestone_id: "milestone.p5800",
      milestone_range: "P5800",
      local_contract_readiness: localContractsReady,
      completed_cross_model_review_ready: completedReviewReady,
      p5800_milestone_closeout_ready: localContractsReady && completedReviewReady,
      single_owner_claude_reviewed_mode: true,
      lower_trust_readiness_allowed: localContractsReady,
      self_approval_allowed: false,
      enterprise_trust_claim_allowed: false,
      human_adjudication_required: false,
      protected_closeout_enabled: false,
      block_reason: completedReviewReady ? null : "p5800_requires_completed_cross_model_qa_receipt_and_finding_loop",
      evidence_ref: "evidence.multi_engine.trust_decision.p5800",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
      next_allowed_action: completedReviewReady ? "freeze P5800 lower-trust milestone" : "collect completed Claude review receipt and finding-loop revalidation before P5800 closeout",
    },
  ];
}

function buildFreezeRows({ engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, generatedAt }) {
  const specs = [
    ["engine_registry_ready", engineRegistryRows.every((row) => row.can_review_own_work === false && row.can_finally_approve === false), "engine registry prevents self-approval and final approval"],
    ["role_assignment_ready", roleAssignmentRows.every((row) => row.self_approval_allowed === false && row.final_approval_allowed === false), "role assignments split planner, implementer, validator, and reviewer"],
    ["qa_packet_ready", crossModelQaPacketRows.every((row) => row.qa_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.self_approval_allowed === false), "cross-model QA packet is ready for Claude review"],
    ["model_upgrade_receipt_ready", modelUpgradeReceiptRows.every((row) => row.upgrade_allowed_without_receipt === false && row.upgrade_applied_now === false), "model upgrades require receipts"],
    ["conflict_resolution_ready", conflictResolutionRows.every((row) => row.auto_pass_allowed === false && row.self_approval_allowed === false), "engine conflicts block unsafe auto PASS"],
    ["reviewer_boundary_ready", reviewerBoundaryRows.every((row) => row.allowed === false && row.boundary_status === "ENFORCED_BY_CONTRACT"), "reviewer boundaries are enforced by contract"],
    ["finding_loop_ready", findingLoopRows.every((row) => row.revalidation_required_after_findings && row.loop_can_close_now === false), "finding loop waits for review receipt and revalidation"],
    ["trust_decision_ready", trustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "trust decision rows preserve lower-trust boundary"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "multi-engine-qa-freeze-row.v1",
    row_id: `multi.engine.qa.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.multi_engine.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.multi_engine.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, verificationRuntime, contract, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:multi-engine-orchestration-qa"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes multi-engine orchestration QA"],
    ["verification_script_registered", Boolean(packageJson.data?.scripts?.[VERIFICATION_COMMAND_NAME]), "verification orchestration runtime script exists"],
    ["verification_runtime_ready", verificationRuntime.summary?.verification_orchestration_runtime_status === VERIFICATION_READY_STATUS, "P5001-P5400 verification runtime is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Multi-Engine Orchestration and Cross-Model QA"), "P5401-P5800 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Multi-Engine Orchestration"), "architecture doc reflects multi-engine orchestration"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Multi-Engine Orchestration"), "review dashboard IA reflects multi-engine orchestration"],
    ["contract_ready", contract.primary_engine_required && contract.reviewer_engine_required && contract.one_engine_self_approval_allowed === false, "multi-engine QA contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P5401-P5800 phase rows pass"],
    ["engines_registered", engineRegistryRows.length >= ENGINE_SPECS.length && engineRegistryRows.every((row) => row.can_review_own_work === false), "engine registry rows are ready"],
    ["roles_assigned", roleAssignmentRows.length >= ROLE_SPECS.length && roleAssignmentRows.every((row) => row.self_approval_allowed === false), "role assignment rows are ready"],
    ["qa_packets_ready", crossModelQaPacketRows.every((row) => row.qa_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.claude_review_receipt_required), "cross-model QA packets are ready"],
    ["model_upgrade_receipts_ready", modelUpgradeReceiptRows.every((row) => row.upgrade_allowed_without_receipt === false && row.receipt_status), "model upgrade receipt rows are ready"],
    ["conflicts_ready", conflictResolutionRows.every((row) => row.auto_pass_allowed === false && row.conflict_status === "POLICY_READY"), "engine conflict policies are ready"],
    ["reviewer_boundaries_ready", reviewerBoundaryRows.every((row) => row.allowed === false && row.boundary_status === "ENFORCED_BY_CONTRACT"), "reviewer no-mutation boundaries are ready"],
    ["finding_loop_ready", findingLoopRows.every((row) => row.revalidation_required_after_findings && row.loop_can_close_now === false), "cross-review finding loop rows are ready"],
    ["trust_decision_ready", trustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "trust decision rows are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_self_approval", contract.one_engine_self_approval_allowed === false && contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "self-approval and final model approval stay disabled"],
    ["boundary_no_runtime_write", contract.agent_runtime_execution_enabled === false && contract.write_action_enabled === false && contract.protected_action_enabled === false, "runtime/write/protected action stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "multi-engine-qa-gate-row.v1",
    row_id: `multi.engine.qa.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.multi_engine.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("qa") || gate_id.includes("reviewer") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.multi_engine_qa.${gate_id}`,
    responsible_owner: "platform_multi_engine_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ verificationRuntime, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    verificationRuntime.summary?.verification_orchestration_runtime_status !== VERIFICATION_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    engineRegistryRows.some((row) => row.can_review_own_work || row.can_finally_approve || row.can_claim_enterprise_trust),
    roleAssignmentRows.some((row) => row.self_approval_allowed || row.final_approval_allowed),
    crossModelQaPacketRows.some((row) => row.self_approval_allowed || row.reviewer_mutation_allowed || row.human_adjudication_required || row.protected_closeout_enabled),
    modelUpgradeReceiptRows.some((row) => row.upgrade_allowed_without_receipt || row.upgrade_applied_now),
    conflictResolutionRows.some((row) => row.auto_pass_allowed || row.self_approval_allowed),
    reviewerBoundaryRows.some((row) => row.allowed),
    findingLoopRows.some((row) => row.loop_can_close_now || row.revalidation_completed_now),
    trustDecisionRows.some((row) => row.enterprise_trust_claim_allowed || row.human_adjudication_required || row.protected_closeout_enabled || row.self_approval_allowed),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  const p5800CloseoutReady = trustDecisionRows.every((row) => row.p5800_milestone_closeout_ready);
  return {
    schema_version: "multi-engine-qa-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5001-P5400",
    multi_engine_orchestration_qa_ready: unsafeFlags.filter(Boolean).length === 0,
    verification_orchestration_runtime_ready: verificationRuntime.summary?.verification_orchestration_runtime_status === VERIFICATION_READY_STATUS,
    primary_engine_registered: engineRegistryRows.some((row) => row.engine_role === "PRIMARY_DEVELOPER"),
    reviewer_engine_registered: engineRegistryRows.some((row) => row.engine_role === "INDEPENDENT_REVIEWER"),
    role_split_ready: roleAssignmentRows.every((row) => row.role_status === "ASSIGNED"),
    cross_model_qa_packet_ready: crossModelQaPacketRows.every((row) => row.qa_packet_status === "READY_FOR_CLAUDE_REVIEW"),
    model_upgrade_receipt_contract_ready: modelUpgradeReceiptRows.every((row) => row.upgrade_allowed_without_receipt === false),
    reviewer_no_mutation_boundary_ready: reviewerBoundaryRows.every((row) => row.allowed === false),
    self_approval_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    completed_cross_model_review_ready: trustDecisionRows.every((row) => row.completed_cross_model_review_ready),
    p5800_milestone_closeout_ready: p5800CloseoutReady,
    p5800_closeout_block_reason: p5800CloseoutReady ? null : "completed Claude review receipt, finding loop, and revalidation are still missing",
    single_owner_claude_reviewed_mode: true,
    lower_trust_readiness_allowed: trustDecisionRows.every((row) => row.lower_trust_readiness_allowed),
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    protected_final_decision_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, verificationRuntime, contract, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include multi-engine QA command"),
    validationItem("verification.ready", "source", verificationRuntime.summary?.verification_orchestration_runtime_status === VERIFICATION_READY_STATUS, "verification orchestration runtime must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P5401-P5800 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Multi-Engine Orchestration"), "architecture must reflect multi-engine orchestration"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Multi-Engine Orchestration"), "dashboard IA must reflect multi-engine orchestration"),
    validationItem("contract.ready", "contract", contract.primary_engine_required && contract.reviewer_engine_required && contract.one_engine_self_approval_allowed === false, "contract must require primary/reviewer engines and block self-approval"),
    validationItem("contract.no_human_gate", "contract", contract.human_adjudication_in_milestone_gate === false && contract.protected_closeout_enabled === false, "human milestone gate and protected closeout must stay disabled"),
    validationItem("phases.count", "phases", phaseRows.length === PHASE_SPECS.length, "all P5401-P5800 phase rows must exist"),
    validationItem("phases.pass", "phases", phaseRows.every((row) => row.current_verdict === "pass"), "all P5401-P5800 phase rows must pass"),
    validationItem("engines.primary_reviewer", "engines", engineRegistryRows.some((row) => row.engine_role === "PRIMARY_DEVELOPER") && engineRegistryRows.some((row) => row.engine_role === "INDEPENDENT_REVIEWER"), "engine registry must include primary developer and independent reviewer"),
    validationItem("engines.no_self_approval", "engines", engineRegistryRows.every((row) => row.can_review_own_work === false && row.can_finally_approve === false), "engines cannot self-approve or finally approve"),
    validationItem("roles.split", "roles", roleAssignmentRows.length === ROLE_SPECS.length && roleAssignmentRows.every((row) => row.self_approval_allowed === false), "role assignments must split duties and block self-approval"),
    validationItem("qa_packet.ready", "qa_packet", crossModelQaPacketRows.every((row) => row.qa_packet_status === "READY_FOR_CLAUDE_REVIEW" && row.claude_review_receipt_required), "QA packets must be ready for Claude review"),
    validationItem("model_upgrade.receipt", "model_upgrade", modelUpgradeReceiptRows.every((row) => row.upgrade_allowed_without_receipt === false && row.upgrade_applied_now === false), "model upgrade must require receipt"),
    validationItem("conflicts.ready", "conflicts", conflictResolutionRows.every((row) => row.auto_pass_allowed === false && row.conflict_status === "POLICY_READY"), "conflict resolution policies must be ready"),
    validationItem("reviewer.boundary", "reviewer", reviewerBoundaryRows.every((row) => row.allowed === false && row.boundary_status === "ENFORCED_BY_CONTRACT"), "reviewer boundaries must be enforced"),
    validationItem("finding_loop.ready", "finding_loop", findingLoopRows.every((row) => row.revalidation_required_after_findings && row.loop_can_close_now === false), "finding loop must require revalidation and stay open"),
    validationItem("trust.ready", "trust", trustDecisionRows.every((row) => row.lower_trust_readiness_allowed && row.enterprise_trust_claim_allowed === false), "trust decision must preserve lower-trust boundary"),
    validationItem("trust.closeout_blocked", "trust", trustDecisionRows.every((row) => row.p5800_milestone_closeout_ready === false), "P5800 closeout must remain blocked without completed cross-model review"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_self_approval", "boundary", boundary.self_approval_allowed === false && boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false, "self-approval and model final approval must be disabled"),
    validationItem("boundary.no_enterprise", "boundary", boundary.enterprise_trust_claim_enabled === false, "enterprise trust must stay disabled"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.agent_runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.protected_action_enabled === false, "agent runtime/write/protected action must stay disabled"),
  ];
}

function buildSummary({ verificationRuntime, phaseRows, engineRegistryRows, roleAssignmentRows, crossModelQaPacketRows, modelUpgradeReceiptRows, conflictResolutionRows, reviewerBoundaryRows, findingLoopRows, trustDecisionRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "multi-engine-orchestration-qa-summary.v1",
    multi_engine_orchestration_qa_status: validation.valid && boundary.multi_engine_orchestration_qa_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P5001-P5400",
    verification_orchestration_runtime_status: verificationRuntime.summary?.verification_orchestration_runtime_status ?? "unknown",
    phase_row_count: phaseRows.length,
    engine_count: engineRegistryRows.length,
    role_assignment_count: roleAssignmentRows.length,
    cross_model_qa_packet_count: crossModelQaPacketRows.length,
    model_upgrade_receipt_count: modelUpgradeReceiptRows.length,
    engine_conflict_count: conflictResolutionRows.length,
    reviewer_boundary_count: reviewerBoundaryRows.length,
    finding_loop_count: findingLoopRows.length,
    trust_decision_count: trustDecisionRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    primary_engine_registered: boundary.primary_engine_registered,
    reviewer_engine_registered: boundary.reviewer_engine_registered,
    role_split_ready: boundary.role_split_ready,
    cross_model_qa_packet_ready: boundary.cross_model_qa_packet_ready,
    model_upgrade_receipt_contract_ready: boundary.model_upgrade_receipt_contract_ready,
    reviewer_no_mutation_boundary_ready: boundary.reviewer_no_mutation_boundary_ready,
    self_approval_allowed: boundary.self_approval_allowed,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    reviewer_mutation_allowed: boundary.reviewer_mutation_allowed,
    completed_cross_model_review_ready: boundary.completed_cross_model_review_ready,
    p5800_milestone_closeout_ready: boundary.p5800_milestone_closeout_ready,
    lower_trust_readiness_allowed: boundary.lower_trust_readiness_allowed,
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

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_multi_engine_qa.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Multi-Engine Orchestration and Cross-Model QA",
    "",
    `Status: ${result.summary.multi_engine_orchestration_qa_status}`,
    `Program: ${result.summary.program_range}`,
    `Verification runtime: ${result.summary.verification_orchestration_runtime_status}`,
    `Engines: ${result.summary.engine_count}`,
    `Role assignments: ${result.summary.role_assignment_count}`,
    `Cross-model QA packets: ${result.summary.cross_model_qa_packet_count}`,
    `Model upgrade receipts: ${result.summary.model_upgrade_receipt_count}`,
    `Gates: ${result.summary.pass_gate_count}/${result.summary.gate_count}`,
    `Self approval allowed: ${result.summary.self_approval_allowed}`,
    `Reviewer mutation allowed: ${result.summary.reviewer_mutation_allowed}`,
    `P5800 closeout ready: ${result.summary.p5800_milestone_closeout_ready}`,
    `Lower-trust readiness allowed: ${result.summary.lower_trust_readiness_allowed}`,
    `Enterprise trust claim enabled: ${result.summary.enterprise_trust_claim_enabled}`,
    `Agent runtime execution enabled: ${result.summary.agent_runtime_execution_enabled}`,
    `Write action enabled: ${result.summary.write_action_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Closeout Boundary",
    "",
    "The multi-engine QA contract is ready, but P5800 closeout remains blocked until a completed Claude Code Opus max review receipt, normalized findings, and revalidation loop evidence are captured. Human adjudication is not part of the current milestone gate, so protected closeout and enterprise-trust claims stay disabled.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
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
  const defaults = DEFAULT_MULTI_ENGINE_ORCHESTRATION_QA_INPUTS;
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
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
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
  console.log(`Usage: node scripts/multi-engine-orchestration-qa.mjs [options]

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
